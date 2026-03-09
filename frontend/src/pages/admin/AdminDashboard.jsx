import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, CheckCircle, Clock, Server, Users, 
  TrendingUp, TrendingDown, Zap, Shield, BarChart3, RefreshCw,
  ChevronRight, Bell, XCircle, AlertCircle, Eye, Check, MessageSquare, Bug
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState("24h");
  const [mounted, setMounted] = useState(false);
  
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
        reportStatsRes
      ] = await Promise.all([
        axios.get(`${API}/admin/overview?range=${range}`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/health/metrics?range=${range}`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/health/rollups?range=${range}&window=5m`).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/alerts?status=open&limit=10`).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/incidents?status=open&limit=5`).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/health/top-endpoints?range=${range}&sort=errors&limit=5`).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/users/metrics`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/feedback?days=30&limit=10`).catch(() => ({ data: { feedback: [] } })),
        axios.get(`${API}/admin/feedback/stats?days=30`).catch(() => ({ data: {} }))
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
    const interval = setInterval(fetchData, 60000); // Refresh every minute
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
      fetchData();
    } catch (error) {
      toast.error("Failed to acknowledge alert");
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      await axios.post(`${API}/admin/alerts/${alertId}/resolve`);
      toast.success("Alert resolved");
      fetchData();
    } catch (error) {
      toast.error("Failed to resolve alert");
    }
  };

  const stagger = (i) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(24px)',
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms`,
  });

  // Compute status color
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
    green: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
    yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" },
    red: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060918] flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-orange-500/30 border-t-orange-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Format rollup data for charts
  const chartData = rollups.map(r => ({
    time: new Date(r.bucket_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    requests: r.requests_total || 0,
    errors: r.errors_5xx || 0,
    latency: r.latency_p95_ms || 0,
  }));

  return (
    <div className="min-h-screen bg-[#060918] text-slate-100">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #f97316, transparent 70%)' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #3B82F6, transparent 70%)' }} />
      </div>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div style={stagger(0)} className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${statusColors[statusColor].bg} ${statusColors[statusColor].border} border animate-pulse`} />
                <p className="text-xs font-mono tracking-[0.3em] uppercase text-slate-500">
                  Platform Backbone
                </p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                <span className="text-slate-100">Ops </span>
                <span className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                  Dashboard
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Time range selector */}
              <div className="flex bg-white/5 rounded-lg p-1">
                {["1h", "24h", "7d", "30d"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1.5 text-xs font-mono rounded-md transition-all ${
                      range === r 
                        ? "bg-orange-500/20 text-orange-400" 
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-slate-400 hover:text-slate-200"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <div className="mt-4 h-px bg-gradient-to-r from-orange-500/40 via-slate-700/50 to-transparent" />
        </div>

        {/* KPI Cards */}
        <div style={stagger(1)} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {/* Uptime */}
          <div className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-slate-500">Uptime</span>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="font-mono text-2xl font-bold text-emerald-400">
              {healthMetrics ? (100 - (healthMetrics.error_rate_5xx || 0)).toFixed(1) : "—"}%
            </p>
          </div>

          {/* Error Rate */}
          <div className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-slate-500">5xx Rate</span>
              <AlertTriangle className={`w-4 h-4 ${(healthMetrics?.error_rate_5xx || 0) > 1 ? "text-red-400" : "text-slate-500"}`} />
            </div>
            <p className={`font-mono text-2xl font-bold ${(healthMetrics?.error_rate_5xx || 0) > 1 ? "text-red-400" : "text-slate-100"}`}>
              {healthMetrics?.error_rate_5xx?.toFixed(2) || "0.00"}%
            </p>
          </div>

          {/* p95 Latency */}
          <div className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-slate-500">p95 Latency</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <p className="font-mono text-2xl font-bold text-slate-100">
              {healthMetrics?.p95_latency_ms?.toFixed(0) || "—"}<span className="text-sm text-slate-500">ms</span>
            </p>
          </div>

          {/* DAU */}
          <div className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-slate-500">DAU</span>
              <Users className="w-4 h-4 text-orange-400" />
            </div>
            <p className="font-mono text-2xl font-bold text-slate-100">
              {userMetrics?.dau?.toLocaleString() || "—"}
            </p>
          </div>

          {/* Active Games */}
          <div className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-slate-500">Active Games</span>
              <Zap className="w-4 h-4 text-yellow-400" />
            </div>
            <p className="font-mono text-2xl font-bold text-slate-100">
              {overview?.active_games || 0}
            </p>
          </div>

          {/* Total Users */}
          <div className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-slate-500">Total Users</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="font-mono text-2xl font-bold text-slate-100">
              {overview?.total_users?.toLocaleString() || "—"}
            </p>
            {overview?.new_users > 0 && (
              <p className="text-[10px] text-emerald-400 mt-1">+{overview.new_users} new</p>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Requests & Errors Chart */}
            <div style={stagger(2)} className="rounded-2xl border border-white/[0.06] overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium">Requests & Errors</span>
                </div>
              </div>
              <div className="p-4 h-[200px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Area type="monotone" dataKey="requests" stroke="#3B82F6" fill="url(#colorRequests)" />
                      <Area type="monotone" dataKey="errors" stroke="#EF4444" fill="url(#colorErrors)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    No data available
                  </div>
                )}
              </div>
            </div>

            {/* Latency Chart */}
            <div style={stagger(3)} className="rounded-2xl border border-white/[0.06] overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium">p95 Latency</span>
                </div>
              </div>
              <div className="p-4 h-[160px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                        formatter={(value) => [`${value}ms`, 'p95']}
                      />
                      <Line type="monotone" dataKey="latency" stroke="#3B82F6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    No data available
                  </div>
                )}
              </div>
            </div>

            {/* Top Failing Endpoints */}
            <div style={stagger(4)} className="rounded-2xl border border-white/[0.06] overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium">Top Failing Endpoints</span>
                </div>
              </div>
              <div className="p-4">
                {topEndpoints.length > 0 ? (
                  <div className="space-y-2">
                    {topEndpoints.map((ep, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs text-slate-300 truncate">
                            <span className="text-slate-500">{ep.method}</span> {ep.endpoint}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <span className="text-xs text-red-400 font-mono">{ep.errors_5xx} 5xx</span>
                          <span className="text-xs text-slate-500 font-mono">{ep.avg_latency_ms}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 text-sm py-4">No failing endpoints</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Ops Copilot Panel */}
          <div className="space-y-6">
            {/* Live Status */}
            <div style={stagger(2)} className="rounded-2xl border border-white/[0.06] overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium">Ops Copilot</span>
                </div>
              </div>
              <div className="p-4">
                <div className={`flex items-center gap-3 p-3 rounded-lg ${statusColors[statusColor].bg} ${statusColors[statusColor].border} border`}>
                  <div className={`w-2 h-2 rounded-full ${statusColor === 'green' ? 'bg-emerald-400' : statusColor === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'} animate-pulse`} />
                  <span className={`text-sm font-medium ${statusColors[statusColor].text}`}>
                    {statusColor === 'green' ? 'All Systems Operational' : 
                     statusColor === 'yellow' ? 'Degraded Performance' : 'Critical Issues Detected'}
                  </span>
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                    <p className="font-mono text-lg font-bold text-slate-100">{userMetrics?.dau || 0}</p>
                    <p className="text-[10px] text-slate-500">DAU</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                    <p className="font-mono text-lg font-bold text-slate-100">{userMetrics?.wau || 0}</p>
                    <p className="text-[10px] text-slate-500">WAU</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                    <p className="font-mono text-lg font-bold text-slate-100">{userMetrics?.mau || 0}</p>
                    <p className="text-[10px] text-slate-500">MAU</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Alerts */}
            <div style={stagger(3)} className="rounded-2xl border border-white/[0.06] overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium">Active Alerts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {alerts.length > 0 && (
                      <span className="px-2 py-0.5 text-xs font-mono bg-red-500/20 text-red-400 rounded-full">
                        {alerts.length}
                      </span>
                    )}
                    <button
                      onClick={() => navigate("/admin/alerts")}
                      className="text-xs text-orange-400 hover:text-orange-300"
                    >
                      View All →
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 max-h-[300px] overflow-y-auto">
                {alerts.length > 0 ? (
                  <div className="space-y-2">
                    {alerts.map((alert) => (
                      <div key={alert.alert_id} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                                alert.severity === 'P0' ? 'bg-red-500/20 text-red-400' :
                                alert.severity === 'P1' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {alert.severity}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {alert.category}
                              </span>
                            </div>
                            <p className="text-sm text-slate-200 truncate">{alert.title}</p>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{alert.summary}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-slate-400 hover:text-emerald-400"
                            onClick={() => handleAckAlert(alert.alert_id)}
                          >
                            <Check className="w-3 h-3 mr-1" /> ACK
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-slate-400 hover:text-blue-400"
                            onClick={() => handleResolveAlert(alert.alert_id)}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Resolve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No active alerts</p>
                  </div>
                )}
              </div>
            </div>

            {/* Open Incidents */}
            <div style={stagger(4)} className="rounded-2xl border border-white/[0.06] overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <div>
                      <span className="text-sm font-medium">Open Incidents</span>
                      <p className="text-[10px] text-slate-500">System-detected platform issues (errors, outages)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {incidents.length > 0 && (
                      <span className="px-2 py-0.5 text-xs font-mono bg-red-500/20 text-red-400 rounded-full">
                        {incidents.length}
                      </span>
                    )}
                    <button
                      onClick={() => navigate("/admin/incidents")}
                      className="text-xs text-orange-400 hover:text-orange-300"
                    >
                      View All →
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4">
                {incidents.length > 0 ? (
                  <div className="space-y-2">
                    {incidents.map((incident) => (
                      <button
                        key={incident.incident_id}
                        onClick={() => navigate(`/admin/incidents/${incident.incident_id}`)}
                        className="w-full text-left p-3 rounded-lg bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                            incident.severity === 'P0' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                          }`}>
                            {incident.severity}
                          </span>
                          <span className={`text-[10px] font-mono ${
                            incident.status === 'open' ? 'text-red-400' : 'text-yellow-400'
                          }`}>
                            {incident.status}
                          </span>
                          <ChevronRight className="w-3 h-3 text-slate-500 ml-auto" />
                        </div>
                        <p className="text-sm text-slate-200">{incident.title}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Opened {new Date(incident.opened_at).toLocaleString()}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <CheckCircle className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No open incidents</p>
                  </div>
                )}
              </div>
            </div>

            {/* User Reports */}
            <div style={stagger(5)} className="rounded-2xl border border-white/[0.06] overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="text-sm font-medium">User Reports</span>
                      <p className="text-[10px] text-slate-500">User-submitted feedback, bugs, and complaints</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {reportStats?.unresolved > 0 && (
                      <span className="px-2 py-0.5 text-xs font-mono bg-purple-500/20 text-purple-400 rounded-full">
                        {reportStats.unresolved} open
                      </span>
                    )}
                    <button
                      onClick={() => navigate("/admin/feedback")}
                      className="text-xs text-orange-400 hover:text-orange-300"
                    >
                      View All →
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4">
                {/* Stats Summary */}
                {reportStats && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                      <p className="font-mono text-lg font-bold text-slate-100">{reportStats.total || 0}</p>
                      <p className="text-[10px] text-slate-500">Total</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                      <p className="font-mono text-lg font-bold text-purple-400">{reportStats.unresolved || 0}</p>
                      <p className="text-[10px] text-slate-500">Open</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                      <p className="font-mono text-lg font-bold text-emerald-400">{reportStats.auto_fixed || 0}</p>
                      <p className="text-[10px] text-slate-500">Auto-fixed</p>
                    </div>
                  </div>
                )}

                {/* Recent Reports */}
                {userReports.length > 0 ? (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {userReports.map((report) => (
                      <button
                        key={report.feedback_id}
                        onClick={() => navigate(`/admin/feedback/${report.feedback_id}`)}
                        className="w-full text-left p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                            report.type === 'bug' ? 'bg-red-500/20 text-red-400' :
                            report.type === 'complaint' ? 'bg-orange-500/20 text-orange-400' :
                            report.type === 'feature_request' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {report.type || 'feedback'}
                          </span>
                          <span className={`text-[10px] font-mono ${
                            report.status === 'resolved' || report.status === 'closed' 
                              ? 'text-emerald-400' 
                              : report.status === 'in_progress' 
                                ? 'text-yellow-400' 
                                : 'text-slate-500'
                          }`}>
                            {report.status || 'pending'}
                          </span>
                          <span className="text-[10px] text-slate-600 font-mono ml-auto">
                            {report.feedback_id}
                          </span>
                        </div>
                        <p className="text-sm text-slate-200 line-clamp-2">{report.content_preview}</p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[10px] text-slate-500">
                            {report.user_name || 'Anonymous'}
                          </p>
                          <p className="text-[10px] text-slate-600">
                            {new Date(report.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No user reports</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={stagger(5)} className="mt-8 text-center">
          <p className="text-xs text-slate-600 font-mono">
            Last updated: {new Date().toLocaleTimeString()} • Auto-refresh: 60s
          </p>
        </div>
      </main>
    </div>
  );
}
