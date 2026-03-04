import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  HelpCircle,
  Circle,
  Play,
  RefreshCw,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const STATUS_CONFIG = {
  accepted: { icon: CheckCircle, color: "text-green-500", label: "Accepted" },
  declined: { icon: XCircle, color: "text-red-500", label: "Declined" },
  maybe: { icon: HelpCircle, color: "text-yellow-500", label: "Maybe" },
  proposed_new_time: { icon: HelpCircle, color: "text-blue-500", label: "Proposed time" },
  no_response: { icon: Circle, color: "text-gray-400", label: "No response" },
  invited: { icon: Circle, color: "text-gray-400", label: "Invited" },
};

export default function EventDashboardPage() {
  const navigate = useNavigate();
  const { occurrenceId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [invites, setInvites] = useState([]);
  const [stats, setStats] = useState(null);
  const [eventTitle, setEventTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [startingGame, setStartingGame] = useState(false);

  const fetchInvites = async () => {
    if (!occurrenceId) return;
    try {
      const res = await axios.get(`${API}/occurrences/${occurrenceId}/invites`);
      const data = res.data;
      setInvites(data.invites || []);
      setStats(data.stats || null);
      if (data.event_id) {
        try {
          const evtRes = await axios.get(`${API}/events/${data.event_id}`);
          setEventTitle(evtRes.data.title || "Game Night");
        } catch {}
      }
    } catch (err) {
      console.error("Failed to fetch invites:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, [occurrenceId]);

  const handleStartGame = async () => {
    try {
      setStartingGame(true);
      const res = await axios.post(`${API}/occurrences/${occurrenceId}/start-game`);
      const gameId = res.data.game_id;
      toast.success(t.scheduler?.gameStarted || "Game started!");
      navigate(`/games/${gameId}`);
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to start game";
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setStartingGame(false);
    }
  };

  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.invited;

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t.common?.back || "Back"}
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl font-bold">
            {eventTitle || (t.scheduler?.eventDashboard || "Event Dashboard")}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchInvites}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {loading ? (
          <Card className="bg-card border-border/50">
            <CardContent className="p-6 text-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats summary */}
            {stats && (
              <Card className="bg-card border-border/50 mb-4">
                <CardContent className="p-4">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 mx-auto mb-1" />
                      <p className="font-heading text-lg font-bold">{stats.accepted}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t.scheduler?.accepted || "Accepted"}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 mx-auto mb-1" />
                      <p className="font-heading text-lg font-bold">{stats.maybe}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t.scheduler?.maybe || "Maybe"}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 mx-auto mb-1" />
                      <p className="font-heading text-lg font-bold">{stats.declined}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t.scheduler?.declined || "Declined"}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-400 mx-auto mb-1" />
                      <p className="font-heading text-lg font-bold">
                        {(stats.invited || 0) + (stats.no_response || 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {t.scheduler?.waiting || "Waiting"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Responses list */}
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t.scheduler?.responses || "Responses"}
            </h2>

            <div className="space-y-2 mb-6">
              {invites.map((invite) => {
                const cfg = getStatusConfig(invite.status);
                const Icon = cfg.icon;
                return (
                  <Card key={invite.invite_id} className="bg-card border-border/50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${cfg.color}`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{invite.user_name}</p>
                          {invite.notes && (
                            <p className="text-xs text-muted-foreground italic">
                              "{invite.notes}"
                            </p>
                          )}
                        </div>
                        <span className={`text-xs font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Start Game button */}
            <Button
              onClick={handleStartGame}
              disabled={startingGame}
              className="w-full bg-primary text-black hover:bg-primary/90"
              size="lg"
            >
              <Play className="w-4 h-4 mr-2" />
              {startingGame
                ? t.common?.loading || "Starting..."
                : t.game?.startGame || "Start Game"}
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
