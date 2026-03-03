import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bell, ArrowLeft, Check, CheckCircle, Filter, RefreshCw,
  AlertTriangle, Shield, BarChart3, FileText, XCircle
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function AlertsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  
  const statusFilter = searchParams.get("status") || "all";
  const severityFilter = searchParams.get("severity") || "all";
  const categoryFilter = searchParams.get("category") || "all";

  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (severityFilter !== "all") params.append("severity", severityFilter);
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      params.append("limit", "100");

      const response = await axios.get(`${API}/admin/alerts?${params.toString()}`);
      setAlerts(response.data || []);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      toast.error("Failed to load alerts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, severityFilter, categoryFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAlerts();
  };

  const handleAckAlert = async (alertId) => {
    try {
      await axios.post(`${API}/admin/alerts/${alertId}/ack`);
      toast.success("Alert acknowledged");
      fetchAlerts();
    } catch (error) {
      toast.error("Failed to acknowledge alert");
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      await axios.post(`${API}/admin/alerts/${alertId}/resolve`);
      toast.success("Alert resolved");
      fetchAlerts();
    } catch (error) {
      toast.error("Failed to resolve alert");
    }
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

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "P0": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "P1": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default: return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "open": return "bg-red-500/20 text-red-400";
      case "acknowledged": return "bg-yellow-500/20 text-yellow-400";
      case "resolved": return "bg-emerald-500/20 text-emerald-400";
      default: return "bg-slate-500/20 text-slate-400";
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case "health": return <AlertTriangle className="w-4 h-4" />;
      case "security": return <Shield className="w-4 h-4" />;
      case "product": return <BarChart3 className="w-4 h-4" />;
      case "report": return <FileText className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

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
              <h1 className="text-2xl font-bold text-slate-100">All Alerts</h1>
              <p className="text-sm text-slate-400 mt-1">
                {alerts.length} alert{alerts.length !== 1 ? "s" : ""} found
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

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500">Status:</span>
            <div className="flex bg-white/[0.02] rounded-lg p-1">
              {["all", "open", "acknowledged", "resolved"].map((s) => (
                <button
                  key={s}
                  onClick={() => updateFilter("status", s)}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-all ${
                    statusFilter === s
                      ? "bg-orange-500/20 text-orange-400"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Severity:</span>
            <div className="flex bg-white/[0.02] rounded-lg p-1">
              {["all", "P0", "P1", "P2"].map((s) => (
                <button
                  key={s}
                  onClick={() => updateFilter("severity", s)}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-all ${
                    severityFilter === s
                      ? "bg-orange-500/20 text-orange-400"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Category:</span>
            <div className="flex bg-white/[0.02] rounded-lg p-1">
              {["all", "health", "security", "product", "report"].map((c) => (
                <button
                  key={c}
                  onClick={() => updateFilter("category", c)}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-all ${
                    categoryFilter === c
                      ? "bg-orange-500/20 text-orange-400"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <div
                key={alert.alert_id}
                className="rounded-xl border border-white/[0.06] p-5"
                style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs font-mono rounded border ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-mono rounded ${getStatusColor(alert.status)}`}>
                        {alert.status}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        {getCategoryIcon(alert.category)}
                        {alert.category}
                      </span>
                      <span className="text-xs text-slate-600 font-mono">
                        {alert.alert_id}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-slate-200 mb-1">{alert.title}</h3>
                    <p className="text-sm text-slate-400 mb-2">{alert.summary}</p>
                    <p className="text-xs text-slate-500">
                      Created {new Date(alert.created_at).toLocaleString()}
                      {alert.acknowledged_at && ` • Acknowledged ${new Date(alert.acknowledged_at).toLocaleString()}`}
                      {alert.resolved_at && ` • Resolved ${new Date(alert.resolved_at).toLocaleString()}`}
                    </p>
                  </div>
                  
                  {alert.status !== "resolved" && (
                    <div className="flex flex-col gap-2">
                      {alert.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                          onClick={() => handleAckAlert(alert.alert_id)}
                        >
                          <Check className="w-3 h-3 mr-1" /> ACK
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => handleResolveAlert(alert.alert_id)}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" /> Resolve
                      </Button>
                    </div>
                  )}
                </div>

                {/* Linked Incident */}
                {alert.incident_id && (
                  <div className="mt-4 pt-4 border-t border-white/[0.04]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-orange-400 hover:text-orange-300"
                      onClick={() => navigate(`/admin/incidents/${alert.incident_id}`)}
                    >
                      View Linked Incident →
                    </Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-white/[0.06] p-12 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <CheckCircle className="w-12 h-12 text-emerald-400/50 mx-auto mb-4" />
              <p className="text-slate-400">No alerts match your filters</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
