import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Users,
  TrendingUp,
  Zap,
  Shield,
  RefreshCw,
  ChevronRight,
  Bell,
  AlertCircle,
  Eye,
  Check,
  MessageSquare,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const SHADOW_KPI =
  "0 1px 2px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.06)";
const SHADOW_CARD_REST =
  "0 1px 3px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.08)";
const SHADOW_CARD_HOVER =
  "0 4px 16px rgba(0, 0, 0, 0.2), 0 12px 40px rgba(0, 0, 0, 0.15)";
const SHADOW_MODAL =
  "0 8px 32px rgba(0, 0, 0, 0.4), 0 24px 80px rgba(0, 0, 0, 0.3)";

const CARD_GRADIENT =
  "linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))";

function KpiCard({ children, className }) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-white/[0.06] cursor-default min-h-[44px]",
        "transition-all duration-200",
        "hover:-translate-y-0.5 hover:[box-shadow:var(--kpi-hover)]",
        className
      )}
      style={{
        padding: "6px",
        background: CARD_GRADIENT,
        boxShadow: SHADOW_KPI,
        ["--kpi-hover"]: SHADOW_CARD_HOVER,
      }}
    >
      <div className="rounded-[12px] bg-white/[0.03] p-3 h-full min-h-[44px]">
        {children}
      </div>
    </div>
  );
}

function DashboardCard({ children, className, interactive, style, innerClassName }) {
  return (
    <div
      className={cn(
        "rounded-[32px] border border-white/[0.06] relative",
        "transition-all duration-200",
        interactive &&
          "hover:-translate-y-0.5 active:scale-[0.99] active:opacity-90 cursor-pointer hover:[box-shadow:var(--card-hover)]",
        className
      )}
      style={{
        padding: "12px",
        background: CARD_GRADIENT,
        boxShadow: SHADOW_CARD_REST,
        ["--card-hover"]: SHADOW_CARD_HOVER,
        ...style,
      }}
    >
      <div
        className={cn(
          "rounded-[16px] bg-white/[0.03] h-full min-h-0 overflow-hidden flex flex-col",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

function PreviewModal({ item, type, onClose, onAck, onResolve, onOpenDetail }) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item || !type) return null;

  const title =
    type === "alert"
      ? item.title || "Alert"
      : type === "incident"
        ? item.title || "Incident"
        : item.content_preview || "User report";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-[32px] border border-white/[0.06]"
        style={{
          padding: "16px",
          background: CARD_GRADIENT,
          boxShadow: SHADOW_MODAL,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute z-20 w-11 h-11 flex items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.1] hover:bg-white/[0.15] active:scale-95 active:opacity-[0.85] transition-all duration-200"
          style={{
            top: "16px",
            right: "16px",
            transform: "translate(50%, -50%)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
          aria-label="Close preview"
        >
          <X className="w-5 h-5 text-slate-300" />
        </button>

        <div
          className="rounded-[16px] bg-white/[0.04] overflow-hidden"
          style={{ borderTopRightRadius: 0, padding: "14px" }}
        >
          <div className="flex items-start gap-3 pr-10">
            {type === "alert" && (
              <Bell className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            )}
            {type === "incident" && (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            {type === "report" && (
              <MessageSquare className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            )}
            <h3
              className="text-slate-100 font-semibold leading-snug"
              style={{ fontSize: "20px", fontWeight: 600 }}
            >
              {title}
            </h3>
          </div>

          {type === "alert" && (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 min-w-[88px] border-white/10 text-slate-200 hover:bg-white/10"
                onClick={() => onAck(item.alert_id)}
              >
                <Check className="w-4 h-4 mr-2" /> ACK
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 min-w-[100px] border-white/10 text-slate-200 hover:bg-white/10"
                onClick={() => onResolve(item.alert_id)}
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Resolve
              </Button>
            </div>
          )}

          <div className="mt-6 space-y-3 border-t border-white/[0.06] pt-5">
            {type === "alert" && (
              <>
                <div className="flex justify-between gap-4 text-[14px]">
                  <span className="text-slate-500">Severity</span>
                  <span className="text-slate-200 font-mono">{item.severity}</span>
                </div>
                <div className="flex justify-between gap-4 text-[14px]">
                  <span className="text-slate-500">Category</span>
                  <span className="text-slate-200 font-mono">{item.category}</span>
                </div>
                <div className="flex justify-between gap-4 text-[16px] pt-2 border-t border-white/[0.06]">
                  <span className="text-slate-500">Status</span>
                  <span className="text-emerald-400 font-medium">
                    {item.status || "open"}
                  </span>
                </div>
                {item.summary && (
                  <p className="text-[16px] text-slate-300 leading-relaxed pt-2">
                    {item.summary}
                  </p>
                )}
              </>
            )}
            {type === "incident" && (
              <>
                <div className="flex justify-between gap-4 text-[14px]">
                  <span className="text-slate-500">Severity</span>
                  <span className="text-slate-200 font-mono">{item.severity}</span>
                </div>
                <div className="flex justify-between gap-4 text-[14px]">
                  <span className="text-slate-500">Status</span>
                  <span
                    className={
                      item.status === "open" ? "text-red-400" : "text-yellow-400"
                    }
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 pt-2">
                  Opened {new Date(item.opened_at).toLocaleString()}
                </p>
              </>
            )}
            {type === "report" && (
              <>
                <div className="flex justify-between gap-4 text-[14px]">
                  <span className="text-slate-500">Type</span>
                  <span className="text-slate-200 font-mono">
                    {item.type || "feedback"}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-[16px]">
                  <span className="text-slate-500">Status</span>
                  <span className="text-slate-200">{item.status || "pending"}</span>
                </div>
                <p className="text-[12px] text-slate-500">
                  {item.user_name || "Anonymous"} ·{" "}
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </>
            )}
          </div>

          <div className="mt-6">
            <Button
              type="button"
              className="h-11 w-full bg-orange-500/90 hover:bg-orange-500 text-white"
              onClick={onOpenDetail}
            >
              Open full detail
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState("24h");
  const [mounted, setMounted] = useState(false);

  const [previewItem, setPreviewItem] = useState(null);
  const [previewType, setPreviewType] = useState(null);

  // Data states
  const [overview, setOverview] = useState(null);
  const [healthMetrics, setHealthMetrics] = useState(null);
  const [rollups, setRollups] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [topEndpoints, setTopEndpoints] = useState([]);
  const [userMetrics, setUserMetrics] = useState(null);
  const [userReports, setUserReports] = useState([]);
  const [reportStats, setReportStats] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [
        overviewRes,
        healthRes,
        rollupsRes,
        alertsRes,
        incidentsRes,
        endpointsRes,
        userMetricsRes,
        userReportsRes,
        reportStatsRes,
      ] = await Promise.all([
        axios.get(`${API}/admin/overview?range=${range}`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/health/metrics?range=${range}`).catch(() => ({ data: {} })),
        axios
          .get(`${API}/admin/health/rollups?range=${range}&window=5m`)
          .catch(() => ({ data: [] })),
        axios.get(`${API}/admin/alerts?status=open&limit=10`).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/incidents?status=open&limit=5`).catch(() => ({ data: [] })),
        axios
          .get(`${API}/admin/health/top-endpoints?range=${range}&sort=errors&limit=5`)
          .catch(() => ({ data: [] })),
        axios.get(`${API}/admin/users/metrics`).catch(() => ({ data: {} })),
        axios
          .get(`${API}/admin/feedback?days=30&limit=10`)
          .catch(() => ({ data: { feedback: [] } })),
        axios.get(`${API}/admin/feedback/stats?days=30`).catch(() => ({ data: {} })),
      ]);

      setOverview(overviewRes.data);
      setHealthMetrics(healthRes.data);
      setRollups(rollupsRes.data || []);
      setAlerts(alertsRes.data || []);
      setIncidents(incidentsRes.data || []);
      setTopEndpoints(endpointsRes.data || []);
      setUserMetrics(userMetricsRes.data);
      setUserReports(userReportsRes.data?.feedback || []);
      setReportStats(reportStatsRes.data);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAckAlert = async (alertId) => {
    try {
      await axios.post(`${API}/admin/alerts/${alertId}/ack`);
      toast.success("Alert acknowledged");
      setPreviewItem(null);
      setPreviewType(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to acknowledge alert");
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      await axios.post(`${API}/admin/alerts/${alertId}/resolve`);
      toast.success("Alert resolved");
      setPreviewItem(null);
      setPreviewType(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to resolve alert");
    }
  };

  const closePreview = () => {
    setPreviewItem(null);
    setPreviewType(null);
  };

  const openPreviewDetail = () => {
    if (!previewItem || !previewType) return;
    if (previewType === "alert") navigate(`/admin/alerts`);
    else if (previewType === "incident")
      navigate(`/admin/incidents/${previewItem.incident_id}`);
    else navigate(`/admin/feedback/${previewItem.feedback_id}`);
    closePreview();
  };

  const stagger = (i) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(24px)",
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms`,
  });

  const getStatusColor = () => {
    if (!healthMetrics) return "yellow";
    const errorRate = healthMetrics.error_rate_5xx || 0;
    const p95 = healthMetrics.p95_latency_ms || 0;
    if (errorRate > 5 || p95 > 5000) return "red";
    if (errorRate > 1 || p95 > 2000) return "yellow";
    return "green";
  };

  const statusColor = getStatusColor();
  const statusColors = {
    green: {
      bg: "bg-emerald-500/20",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
    },
    yellow: {
      bg: "bg-yellow-500/20",
      text: "text-yellow-400",
      border: "border-yellow-500/30",
    },
    red: {
      bg: "bg-red-500/20",
      text: "text-red-400",
      border: "border-red-500/30",
    },
  };

  const pieRequestData = useMemo(() => {
    const totalReq = rollups.reduce((s, r) => s + (r.requests_total || 0), 0);
    const totalErr = rollups.reduce((s, r) => s + (r.errors_5xx || 0), 0);
    const success = Math.max(0, totalReq - totalErr);
    return [
      { name: "Success", value: success, color: "#3B82F6" },
      { name: "Fail", value: totalErr, color: "#EF4444" },
    ];
  }, [rollups]);

  const pieIncidentData = useMemo(() => {
    const counts = {};
    incidents.forEach((inc) => {
      const st = (inc.status || "open").toLowerCase();
      counts[st] = (counts[st] || 0) + 1;
    });
    const colorMap = {
      open: "#EF4444",
      investigating: "#EAB308",
      acknowledged: "#EAB308",
      resolved: "#22C55E",
      closed: "#22C55E",
    };
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: colorMap[name] || "#64748B",
    }));
  }, [incidents]);

  const pieRequestTotal = pieRequestData.reduce((s, d) => s + d.value, 0);
  const pieRequestCenter =
    pieRequestTotal > 0
      ? pieRequestData[0].value >= pieRequestData[1].value
        ? "Success"
        : "Errors"
      : "—";

  const pieIncidentTotal = pieIncidentData.reduce((s, d) => s + d.value, 0);
  const pieIncidentCenter =
    pieIncidentTotal === 0
      ? "All Clear"
      : pieIncidentData.reduce((a, b) => (a.value >= b.value ? a : b)).name;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060918] flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-orange-500/30 border-t-orange-400 animate-spin" />
        </div>
      </div>
    );
  }

  const chartData = rollups.map((r) => ({
    time: new Date(r.bucket_start).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    requests: r.requests_total || 0,
    errors: r.errors_5xx || 0,
    latency: r.latency_p95_ms || 0,
  }));

  return (
    <div className="min-h-screen bg-[#060918] text-slate-100">
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.05]"
          style={{
            background: "radial-gradient(circle, #f97316, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{
            background: "radial-gradient(circle, #3B82F6, transparent 70%)",
          }}
        />
      </div>

      <PreviewModal
        item={previewItem}
        type={previewType}
        onClose={closePreview}
        onAck={handleAckAlert}
        onResolve={handleResolveAlert}
        onOpenDetail={openPreviewDetail}
      />

      <main className="relative max-w-[1600px] mx-auto px-4 sm:px-5 lg:px-6 py-5">
        <div style={stagger(0)} className="mb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-3 h-3 rounded-full ${statusColors[statusColor].bg} ${statusColors[statusColor].border} border animate-pulse`}
                />
                <p
                  className="font-mono tracking-[0.2em] uppercase text-slate-500"
                  style={{ fontSize: "12px", fontWeight: 400 }}
                >
                  Platform Backbone
                </p>
              </div>
              <h1
                className="font-bold tracking-tight text-slate-100"
                style={{ fontSize: "34px", fontWeight: 700, lineHeight: 1.15 }}
              >
                Ops{" "}
                <span className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                  Dashboard
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex bg-white/5 rounded-xl p-1 gap-0.5">
                {["1h", "24h", "7d", "30d"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={cn(
                      "h-11 min-w-[44px] px-3 rounded-lg font-mono transition-all duration-200",
                      "active:scale-[0.98] active:opacity-[0.85]",
                      range === r
                        ? "bg-orange-500/20 text-orange-400"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                    style={{ fontSize: "12px", fontWeight: 400 }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-11 h-11 flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] active:scale-[0.98] active:opacity-[0.85] transition-all duration-200 disabled:opacity-50"
                aria-label="Refresh dashboard"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-orange-500/40 via-slate-700/50 to-transparent" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:items-stretch">
          {/* Left content */}
          <div
            className={cn(
              "grid gap-4 min-w-0",
              "grid-cols-1",
              "lg:grid-cols-[2fr_1fr]",
              "lg:[grid-template-areas:'kpi-r1_kpi-r1'_'kpi-r2_kpi-r2'_'chart-a_pie-a'_'chart-b_pie-b'_'endpoints_endpoints']",
              "lg:[grid-template-rows:auto_auto_minmax(220px,1fr)_minmax(220px,1fr)_auto]"
            )}
          >
            <div
              style={stagger(1)}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:[grid-area:kpi-r1]"
            >
              <KpiCard>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-mono uppercase text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 400 }}
                  >
                    Uptime
                  </span>
                  <Server className="w-4 h-4 text-emerald-400" />
                </div>
                <p
                  className="font-mono text-emerald-400"
                  style={{ fontSize: "24px", fontWeight: 700 }}
                >
                  {healthMetrics
                    ? (100 - (healthMetrics.error_rate_5xx || 0)).toFixed(1)
                    : "—"}
                  %
                </p>
              </KpiCard>
              <KpiCard>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-mono uppercase text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 400 }}
                  >
                    5xx Rate
                  </span>
                  <AlertTriangle
                    className={`w-4 h-4 ${(healthMetrics?.error_rate_5xx || 0) > 1 ? "text-red-400" : "text-slate-500"}`}
                  />
                </div>
                <p
                  className={cn(
                    "font-mono",
                    (healthMetrics?.error_rate_5xx || 0) > 1
                      ? "text-red-400"
                      : "text-slate-100"
                  )}
                  style={{ fontSize: "24px", fontWeight: 700 }}
                >
                  {healthMetrics?.error_rate_5xx?.toFixed(2) || "0.00"}%
                </p>
              </KpiCard>
              <KpiCard>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-mono uppercase text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 400 }}
                  >
                    p95 Latency
                  </span>
                  <Clock className="w-4 h-4 text-blue-400" />
                </div>
                <p className="font-mono text-slate-100" style={{ fontSize: "24px", fontWeight: 700 }}>
                  {healthMetrics?.p95_latency_ms?.toFixed(0) || "—"}
                  <span className="text-slate-500 text-base font-normal ml-0.5">ms</span>
                </p>
              </KpiCard>
              <KpiCard>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-mono uppercase text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 400 }}
                  >
                    DAU
                  </span>
                  <Users className="w-4 h-4 text-orange-400" />
                </div>
                <p className="font-mono text-slate-100" style={{ fontSize: "24px", fontWeight: 700 }}>
                  {userMetrics?.dau?.toLocaleString() || "—"}
                </p>
              </KpiCard>
            </div>

            <div
              style={stagger(2)}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:[grid-area:kpi-r2]"
            >
              <KpiCard>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-mono uppercase text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 400 }}
                  >
                    WAU
                  </span>
                  <Users className="w-4 h-4 text-sky-400" />
                </div>
                <p className="font-mono text-slate-100" style={{ fontSize: "24px", fontWeight: 700 }}>
                  {userMetrics?.wau?.toLocaleString() || "—"}
                </p>
              </KpiCard>
              <KpiCard>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-mono uppercase text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 400 }}
                  >
                    MAU
                  </span>
                  <Users className="w-4 h-4 text-indigo-400" />
                </div>
                <p className="font-mono text-slate-100" style={{ fontSize: "24px", fontWeight: 700 }}>
                  {userMetrics?.mau?.toLocaleString() || "—"}
                </p>
              </KpiCard>
              <KpiCard>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-mono uppercase text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 400 }}
                  >
                    Active Games
                  </span>
                  <Zap className="w-4 h-4 text-yellow-400" />
                </div>
                <p className="font-mono text-slate-100" style={{ fontSize: "24px", fontWeight: 700 }}>
                  {overview?.active_games || 0}
                </p>
              </KpiCard>
              <KpiCard>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-mono uppercase text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 400 }}
                  >
                    Total Users
                  </span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="font-mono text-slate-100" style={{ fontSize: "24px", fontWeight: 700 }}>
                  {overview?.total_users?.toLocaleString() || "—"}
                </p>
                {overview?.new_users > 0 && (
                  <p className="text-emerald-400 mt-1" style={{ fontSize: "12px", fontWeight: 400 }}>
                    +{overview.new_users} new
                  </p>
                )}
              </KpiCard>
            </div>

            {/* Requests & Errors */}
            <DashboardCard style={stagger(3)} className="lg:[grid-area:chart-a] min-h-[220px]">
              <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-orange-400" />
                  <span className="text-slate-100 font-semibold" style={{ fontSize: "20px", fontWeight: 600 }}>
                    Requests &amp; Errors
                  </span>
                </div>
              </div>
              <div className="p-3 flex-1 min-h-[200px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #1e293b",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#94a3b8" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="requests"
                        stroke="#3B82F6"
                        fill="url(#colorRequests)"
                      />
                      <Area
                        type="monotone"
                        dataKey="errors"
                        stroke="#EF4444"
                        fill="url(#colorErrors)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500" style={{ fontSize: "16px" }}>
                    No data available
                  </div>
                )}
              </div>
            </DashboardCard>

            {/* Pie: Success / Fail */}
            <DashboardCard style={stagger(4)} className="lg:[grid-area:pie-a] min-h-[220px]">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <span className="text-slate-100 font-semibold" style={{ fontSize: "20px", fontWeight: 600 }}>
                  Request outcome
                </span>
                <p className="text-slate-500 mt-0.5" style={{ fontSize: "12px", fontWeight: 400 }}>
                  Success vs 5xx (rollup sum)
                </p>
              </div>
              <div className="p-3 flex-1 min-h-[180px] relative">
                {pieRequestTotal > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieRequestData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius="58%"
                          outerRadius="82%"
                          paddingAngle={2}
                        >
                          {pieRequestData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#0f172a",
                            border: "1px solid #1e293b",
                            borderRadius: "8px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-4">
                      <span
                        className="text-slate-100 font-semibold capitalize"
                        style={{ fontSize: "20px", fontWeight: 600 }}
                      >
                        {pieRequestCenter}
                      </span>
                      <span className="text-slate-500" style={{ fontSize: "12px", fontWeight: 400 }}>
                        dominant
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500" style={{ fontSize: "16px" }}>
                    No rollup data
                  </div>
                )}
              </div>
            </DashboardCard>

            {/* p95 Latency */}
            <DashboardCard style={stagger(3)} className="lg:[grid-area:chart-b] min-h-[220px]">
              <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-100 font-semibold" style={{ fontSize: "20px", fontWeight: 600 }}>
                    p95 Latency
                  </span>
                </div>
              </div>
              <div className="p-3 flex-1 min-h-[180px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #1e293b",
                          borderRadius: "8px",
                        }}
                        formatter={(value) => [`${value}ms`, "p95"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="latency"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500" style={{ fontSize: "16px" }}>
                    No data available
                  </div>
                )}
              </div>
            </DashboardCard>

            {/* Pie: Incidents */}
            <DashboardCard style={stagger(4)} className="lg:[grid-area:pie-b] min-h-[220px]">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <span className="text-slate-100 font-semibold" style={{ fontSize: "20px", fontWeight: 600 }}>
                  Incident status
                </span>
                <p className="text-slate-500 mt-0.5" style={{ fontSize: "12px", fontWeight: 400 }}>
                  Open incidents by status
                </p>
              </div>
              <div className="p-3 flex-1 min-h-[180px] relative">
                {pieIncidentTotal > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieIncidentData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius="58%"
                          outerRadius="82%"
                          paddingAngle={2}
                        >
                          {pieIncidentData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#0f172a",
                            border: "1px solid #1e293b",
                            borderRadius: "8px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-4">
                      <span
                        className="text-slate-100 font-semibold capitalize"
                        style={{ fontSize: "20px", fontWeight: 600 }}
                      >
                        {pieIncidentCenter}
                      </span>
                      <span className="text-slate-500" style={{ fontSize: "12px", fontWeight: 400 }}>
                        top share
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                    <CheckCircle className="w-10 h-10 text-emerald-500/40" />
                    <span style={{ fontSize: "20px", fontWeight: 600 }} className="text-slate-300">
                      All Clear
                    </span>
                  </div>
                )}
              </div>
            </DashboardCard>

            {/* Top endpoints */}
            <DashboardCard style={stagger(5)} className="lg:[grid-area:endpoints]">
              <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-slate-100 font-semibold" style={{ fontSize: "20px", fontWeight: 600 }}>
                    Top Failing Endpoints
                  </span>
                </div>
              </div>
              <div className="p-3">
                {topEndpoints.length > 0 ? (
                  <div className="space-y-2">
                    {topEndpoints.map((ep, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 min-h-[44px] px-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                      >
                        <div className="flex-1 min-w-0 py-2">
                          <p className="font-mono text-slate-300 truncate" style={{ fontSize: "14px", fontWeight: 400 }}>
                            <span className="text-slate-500">{ep.method}</span> {ep.endpoint}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-red-400 font-mono" style={{ fontSize: "12px", fontWeight: 400 }}>
                            {ep.errors_5xx} 5xx
                          </span>
                          <span className="text-slate-500 font-mono" style={{ fontSize: "12px", fontWeight: 400 }}>
                            {ep.avg_latency_ms}ms
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-6" style={{ fontSize: "16px", fontWeight: 400 }}>
                    No failing endpoints
                  </p>
                )}
              </div>
            </DashboardCard>
          </div>

          {/* Right panel — single full-height card */}
          <div className="min-h-0 flex flex-col lg:min-h-[640px]">
            <DashboardCard
              className="flex-1 flex flex-col min-h-0 h-full"
              innerClassName="flex flex-col flex-1 min-h-0"
              style={stagger(2)}
            >
              {/* Ops Status */}
              <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-orange-400" />
                  <h2 className="text-slate-100 font-bold" style={{ fontSize: "24px", fontWeight: 700 }}>
                    Ops Status
                  </h2>
                </div>
                <div
                  className={`flex items-center gap-3 min-h-[44px] px-3 rounded-xl ${statusColors[statusColor].bg} ${statusColors[statusColor].border} border`}
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      statusColor === "green"
                        ? "bg-emerald-400"
                        : statusColor === "yellow"
                          ? "bg-yellow-400"
                          : "bg-red-400"
                    } animate-pulse`}
                  />
                  <span
                    className={`font-medium ${statusColors[statusColor].text}`}
                    style={{ fontSize: "16px", fontWeight: 400 }}
                  >
                    {statusColor === "green"
                      ? "All Systems Operational"
                      : statusColor === "yellow"
                        ? "Degraded Performance"
                        : "Critical Issues Detected"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[
                    { label: "DAU", value: userMetrics?.dau ?? 0 },
                    { label: "WAU", value: userMetrics?.wau ?? 0 },
                    { label: "MAU", value: userMetrics?.mau ?? 0 },
                  ].map((m) => (
                    <div key={m.label} className="text-center p-3 rounded-xl bg-white/[0.02] min-h-[44px] flex flex-col justify-center">
                      <p className="font-mono text-slate-100 font-bold" style={{ fontSize: "18px", fontWeight: 600 }}>
                        {m.value}
                      </p>
                      <p className="text-slate-500" style={{ fontSize: "12px", fontWeight: 400 }}>
                        {m.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Alerts */}
              <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bell className="w-4 h-4 text-yellow-400 shrink-0" />
                    <h2 className="text-slate-100 font-bold truncate" style={{ fontSize: "24px", fontWeight: 700 }}>
                      Active Alerts
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {alerts.length > 0 && (
                      <span className="px-2 py-1 font-mono bg-red-500/20 text-red-400 rounded-full" style={{ fontSize: "12px", fontWeight: 400 }}>
                        {alerts.length}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate("/admin/alerts")}
                      className="h-11 px-2 flex items-center text-orange-400 hover:text-orange-300 transition-all duration-200 active:scale-[0.98] active:opacity-[0.85]"
                      style={{ fontSize: "14px", fontWeight: 400 }}
                    >
                      View All →
                    </button>
                  </div>
                </div>
                <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
                  {alerts.length > 0 ? (
                    alerts.map((alert) => (
                      <div
                        key={alert.alert_id}
                        className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 space-y-3"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0 min-h-[44px]">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 font-mono rounded",
                                  alert.severity === "P0"
                                    ? "bg-red-500/20 text-red-400"
                                    : alert.severity === "P1"
                                      ? "bg-orange-500/20 text-orange-400"
                                      : "bg-yellow-500/20 text-yellow-400"
                                )}
                                style={{ fontSize: "12px", fontWeight: 400 }}
                              >
                                {alert.severity}
                              </span>
                              <span className="text-slate-500 font-mono" style={{ fontSize: "12px", fontWeight: 400 }}>
                                {alert.category}
                              </span>
                            </div>
                            <p className="text-slate-200" style={{ fontSize: "16px", fontWeight: 400 }}>
                              {alert.title}
                            </p>
                            <p className="text-slate-500 mt-0.5 line-clamp-2" style={{ fontSize: "12px", fontWeight: 400 }}>
                              {alert.summary}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] active:scale-95 active:opacity-[0.85] transition-all duration-200"
                            aria-label="Preview alert"
                            onClick={() => {
                              setPreviewItem(alert);
                              setPreviewType("alert");
                            }}
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-11 border-white/10 text-slate-200 hover:bg-white/10"
                            style={{ fontSize: "14px", fontWeight: 400 }}
                            onClick={() => handleAckAlert(alert.alert_id)}
                          >
                            <Check className="w-4 h-4 mr-1" /> ACK
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-11 border-white/10 text-slate-200 hover:bg-white/10"
                            style={{ fontSize: "14px", fontWeight: 400 }}
                            onClick={() => handleResolveAlert(alert.alert_id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" /> Resolve
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
                      <p className="text-slate-500" style={{ fontSize: "16px", fontWeight: 400 }}>
                        No active alerts
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Open Incidents */}
              <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-1" />
                    <div>
                      <h2 className="text-slate-100 font-bold" style={{ fontSize: "24px", fontWeight: 700 }}>
                        Open Incidents
                      </h2>
                      <p className="text-slate-500" style={{ fontSize: "12px", fontWeight: 400 }}>
                        Platform issues (errors, outages)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {incidents.length > 0 && (
                      <span className="px-2 py-1 font-mono bg-red-500/20 text-red-400 rounded-full" style={{ fontSize: "12px", fontWeight: 400 }}>
                        {incidents.length}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate("/admin/incidents")}
                      className="h-11 px-2 flex items-center text-orange-400 hover:text-orange-300 transition-all duration-200 active:scale-[0.98] active:opacity-[0.85]"
                      style={{ fontSize: "14px", fontWeight: 400 }}
                    >
                      View All →
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {incidents.length > 0 ? (
                    incidents.map((incident) => (
                      <div
                        key={incident.incident_id}
                        className="flex items-stretch gap-1 rounded-xl bg-red-500/5 border border-red-500/20 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/incidents/${incident.incident_id}`)}
                          className="flex-1 text-left min-h-[44px] px-3 py-2 hover:bg-red-500/10 transition-all duration-200 active:scale-[0.99] active:opacity-90"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 font-mono rounded",
                                incident.severity === "P0"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-orange-500/20 text-orange-400"
                              )}
                              style={{ fontSize: "12px", fontWeight: 400 }}
                            >
                              {incident.severity}
                            </span>
                            <span
                              className={cn(
                                "font-mono",
                                incident.status === "open" ? "text-red-400" : "text-yellow-400"
                              )}
                              style={{ fontSize: "12px", fontWeight: 400 }}
                            >
                              {incident.status}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-500 ml-auto" />
                          </div>
                          <p className="text-slate-200" style={{ fontSize: "16px", fontWeight: 400 }}>
                            {incident.title}
                          </p>
                          <p className="text-slate-500 mt-0.5" style={{ fontSize: "12px", fontWeight: 400 }}>
                            Opened {new Date(incident.opened_at).toLocaleString()}
                          </p>
                        </button>
                        <button
                          type="button"
                          className="w-11 h-11 shrink-0 self-center mr-1 flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] active:scale-95 active:opacity-[0.85] transition-all duration-200"
                          aria-label="Preview incident"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewItem(incident);
                            setPreviewType("incident");
                          }}
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <CheckCircle className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
                      <p className="text-slate-500" style={{ fontSize: "16px", fontWeight: 400 }}>
                        No open incidents
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* User Reports */}
              <div className="px-4 py-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-start justify-between gap-2 mb-3 shrink-0">
                  <div className="flex items-start gap-2 min-w-0">
                    <MessageSquare className="w-4 h-4 text-purple-400 shrink-0 mt-1" />
                    <div>
                      <h2 className="text-slate-100 font-bold" style={{ fontSize: "24px", fontWeight: 700 }}>
                        User Reports
                      </h2>
                      <p className="text-slate-500" style={{ fontSize: "12px", fontWeight: 400 }}>
                        Feedback, bugs, complaints
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {reportStats?.unresolved > 0 && (
                      <span className="px-2 py-1 font-mono bg-purple-500/20 text-purple-400 rounded-full" style={{ fontSize: "12px", fontWeight: 400 }}>
                        {reportStats.unresolved} open
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate("/admin/feedback")}
                      className="h-11 px-2 flex items-center text-orange-400 hover:text-orange-300 transition-all duration-200 active:scale-[0.98] active:opacity-[0.85]"
                      style={{ fontSize: "14px", fontWeight: 400 }}
                    >
                      View All →
                    </button>
                  </div>
                </div>

                {reportStats && (
                  <div className="grid grid-cols-3 gap-2 mb-4 shrink-0">
                    {[
                      { label: "Total", value: reportStats.total || 0, color: "text-slate-100" },
                      { label: "Open", value: reportStats.unresolved || 0, color: "text-purple-400" },
                      { label: "Auto-fixed", value: reportStats.auto_fixed || 0, color: "text-emerald-400" },
                    ].map((s) => (
                      <div key={s.label} className="text-center p-3 rounded-xl bg-white/[0.02] min-h-[44px] flex flex-col justify-center">
                        <p className={cn("font-mono font-bold", s.color)} style={{ fontSize: "18px", fontWeight: 600 }}>
                          {s.value}
                        </p>
                        <p className="text-slate-500" style={{ fontSize: "12px", fontWeight: 400 }}>
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                  {userReports.length > 0 ? (
                    userReports.map((report) => (
                      <div
                        key={report.feedback_id}
                        className="flex items-stretch gap-1 rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/feedback/${report.feedback_id}`)}
                          className="flex-1 text-left min-h-[44px] px-3 py-2 hover:bg-white/[0.04] transition-all duration-200 active:scale-[0.99] active:opacity-90"
                        >
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 font-mono rounded",
                                report.type === "bug"
                                  ? "bg-red-500/20 text-red-400"
                                  : report.type === "complaint"
                                    ? "bg-orange-500/20 text-orange-400"
                                    : report.type === "feature_request"
                                      ? "bg-blue-500/20 text-blue-400"
                                      : "bg-slate-500/20 text-slate-400"
                              )}
                              style={{ fontSize: "12px", fontWeight: 400 }}
                            >
                              {report.type || "feedback"}
                            </span>
                            <span
                              className={cn(
                                "font-mono",
                                report.status === "resolved" || report.status === "closed"
                                  ? "text-emerald-400"
                                  : report.status === "in_progress"
                                    ? "text-yellow-400"
                                    : "text-slate-500"
                              )}
                              style={{ fontSize: "12px", fontWeight: 400 }}
                            >
                              {report.status || "pending"}
                            </span>
                            <span className="text-slate-600 font-mono ml-auto" style={{ fontSize: "12px", fontWeight: 400 }}>
                              {report.feedback_id}
                            </span>
                          </div>
                          <p className="text-slate-200 line-clamp-2" style={{ fontSize: "16px", fontWeight: 400 }}>
                            {report.content_preview}
                          </p>
                          <div className="flex items-center justify-between mt-2 gap-2">
                            <p className="text-slate-500" style={{ fontSize: "12px", fontWeight: 400 }}>
                              {report.user_name || "Anonymous"}
                            </p>
                            <p className="text-slate-600" style={{ fontSize: "12px", fontWeight: 400 }}>
                              {new Date(report.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          className="w-11 h-11 shrink-0 self-center mr-1 flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] active:scale-95 active:opacity-[0.85] transition-all duration-200"
                          aria-label="Preview report"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewItem(report);
                            setPreviewType("report");
                          }}
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-500" style={{ fontSize: "16px", fontWeight: 400 }}>
                        No user reports
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </DashboardCard>
          </div>
        </div>

        <div style={stagger(6)} className="mt-6 text-center">
          <p className="text-slate-600 font-mono" style={{ fontSize: "12px", fontWeight: 400 }}>
            Last updated: {new Date().toLocaleTimeString()} • Auto-refresh: 60s
          </p>
        </div>
      </main>
    </div>
  );
}
