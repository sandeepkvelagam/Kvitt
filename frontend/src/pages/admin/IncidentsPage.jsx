import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, CheckCircle, AlertTriangle, Clock, Filter
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function IncidentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const statusFilter = searchParams.get("status") || "all";
  const severityFilter = searchParams.get("severity") || "all";

  const fetchIncidents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      params.append("limit", "100");

      const response = await axios.get(`${API}/admin/incidents?${params.toString()}`);
      setIncidents(response.data || []);
    } catch (error) {
      console.error("Error fetching incidents:", error);
      toast.error("Failed to load incidents");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchIncidents();
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
      case "mitigating": return "bg-yellow-500/20 text-yellow-400";
      case "resolved": return "bg-emerald-500/20 text-emerald-400";
      default: return "bg-slate-500/20 text-slate-400";
    }
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Client-side severity filter (backend only supports status filter)
  const filtered = severityFilter === "all"
    ? incidents
    : incidents.filter((i) => i.severity === severityFilter);

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
          style={{ background: 'radial-gradient(circle, #EF4444, transparent 70%)' }} />
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
              <h1 className="text-2xl font-bold text-slate-100">All Incidents</h1>
              <p className="text-sm text-slate-400 mt-1">
                {filtered.length} incident{filtered.length !== 1 ? "s" : ""} found
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
              {["all", "open", "mitigating", "resolved"].map((s) => (
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
        </div>

        {/* Incidents List */}
        <div className="space-y-3">
          {filtered.length > 0 ? (
            filtered.map((incident, index) => (
              <button
                key={incident.incident_id}
                onClick={() => navigate(`/admin/incidents/${incident.incident_id}`)}
                className="w-full text-left rounded-xl border border-white/[0.06] p-5 transition-all hover:border-white/[0.12] hover:scale-[1.005]"
                style={{
                  background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))',
                  opacity: 0,
                  animation: `fadeIn 0.3s ease-out ${index * 0.05}s forwards`
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs font-mono rounded border ${getSeverityColor(incident.severity)}`}>
                        {incident.severity}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-mono rounded ${getStatusColor(incident.status)}`}>
                        {incident.status}
                      </span>
                      <span className="text-xs text-slate-600 font-mono">
                        {incident.incident_id}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-slate-200 mb-1 truncate">
                      {incident.title}
                    </h3>
                    {incident.current_summary && (
                      <p className="text-sm text-slate-400 mb-2 line-clamp-2">
                        {incident.current_summary}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Opened {formatRelativeTime(incident.opened_at)}
                      </span>
                      {incident.closed_at && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          Closed {formatRelativeTime(incident.closed_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-slate-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-xl border border-white/[0.06] p-12 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <CheckCircle className="w-12 h-12 text-emerald-400/50 mx-auto mb-4" />
              <p className="text-slate-400">No incidents match your filters</p>
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
