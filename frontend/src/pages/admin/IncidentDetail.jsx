import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertCircle, ArrowLeft, Clock, User, CheckCircle, 
  AlertTriangle, FileText, Send, RefreshCw
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function IncidentDetail() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [incident, setIncident] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [eventType, setEventType] = useState("updated");
  const [submitting, setSubmitting] = useState(false);

  const fetchIncident = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/incidents/${incidentId}`);
      setIncident(response.data);
    } catch (error) {
      console.error("Error fetching incident:", error);
      toast.error("Failed to load incident");
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  const handleAddTimelineEvent = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSubmitting(true);
    try {
      await axios.post(`${API}/admin/incidents/${incidentId}/timeline`, {
        event_type: eventType,
        message: newMessage.trim()
      });
      toast.success("Timeline event added");
      setNewMessage("");
      fetchIncident();
    } catch (error) {
      toast.error("Failed to add timeline event");
    } finally {
      setSubmitting(false);
    }
  };

  const getEventIcon = (type) => {
    switch (type) {
      case "detected": return <AlertCircle className="w-4 h-4 text-red-400" />;
      case "updated": return <FileText className="w-4 h-4 text-blue-400" />;
      case "mitigated": return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case "resolved": return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "postmortem": return <FileText className="w-4 h-4 text-purple-400" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060918] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-orange-500/30 border-t-orange-400 animate-spin" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="min-h-screen bg-[#060918] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-slate-400">Incident not found</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/admin")}>
            Back to Dashboard
          </Button>
        </div>
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

      <main className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-1 text-xs font-mono rounded border ${getSeverityColor(incident.severity)}`}>
                  {incident.severity}
                </span>
                <span className={`px-2 py-1 text-xs font-mono rounded ${getStatusColor(incident.status)}`}>
                  {incident.status}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {incident.incident_id}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-100">{incident.title}</h1>
              <p className="text-sm text-slate-400 mt-2">
                Opened {new Date(incident.opened_at).toLocaleString()}
                {incident.closed_at && ` • Closed ${new Date(incident.closed_at).toLocaleString()}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchIncident}
              className="text-slate-400"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Summary */}
        {incident.current_summary && (
          <div className="rounded-xl border border-white/[0.06] p-5 mb-6"
            style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
            <h2 className="text-sm font-medium text-slate-400 mb-2">Current Summary</h2>
            <p className="text-slate-200">{incident.current_summary}</p>
          </div>
        )}

        {/* Root Cause */}
        {incident.root_cause && (
          <div className="rounded-xl border border-white/[0.06] p-5 mb-6"
            style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
            <h2 className="text-sm font-medium text-slate-400 mb-2">Root Cause</h2>
            <p className="text-slate-200">{incident.root_cause}</p>
          </div>
        )}

        {/* Timeline */}
        <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6"
          style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <h2 className="text-sm font-medium">Incident Timeline</h2>
          </div>
          <div className="p-5">
            {incident.timeline && incident.timeline.length > 0 ? (
              <div className="space-y-4">
                {incident.timeline.map((event, index) => (
                  <div key={event.id || index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="p-2 rounded-full bg-white/[0.05]">
                        {getEventIcon(event.event_type)}
                      </div>
                      {index < incident.timeline.length - 1 && (
                        <div className="w-px h-full bg-white/[0.06] my-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500 uppercase">
                          {event.event_type}
                        </span>
                        <span className="text-xs text-slate-600">
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200">{event.message}</p>
                      {event.actor_user_id && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <User className="w-3 h-3" /> {event.actor_user_id}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-500 py-4">No timeline events yet</p>
            )}
          </div>
        </div>

        {/* Add Timeline Event */}
        {incident.status !== "resolved" && (
          <div className="rounded-xl border border-white/[0.06] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
            <div className="px-5 py-4 border-b border-white/[0.04]">
              <h2 className="text-sm font-medium">Add Timeline Event</h2>
            </div>
            <form onSubmit={handleAddTimelineEvent} className="p-5">
              <div className="flex gap-3 mb-4">
                {["updated", "mitigated", "resolved", "postmortem"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEventType(type)}
                    className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all ${
                      eventType === type
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        : "bg-white/[0.02] text-slate-500 border border-white/[0.04] hover:text-slate-300"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Describe what happened or what action was taken..."
                className="w-full h-24 px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 resize-none"
              />
              <div className="flex justify-end mt-4">
                <Button
                  type="submit"
                  disabled={submitting || !newMessage.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {submitting ? "Adding..." : "Add Event"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
