import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  ChevronRight,
  ArrowLeft,
  Repeat,
  DollarSign,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const STATUS_COLORS = {
  accepted: "bg-green-500",
  declined: "bg-red-500",
  maybe: "bg-yellow-500",
  invited: "bg-gray-400",
};

export default function SchedulerPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API}/events`);
      setEvents(res.data?.events || res.data || []);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getRsvpColor = (status) => STATUS_COLORS[status] || STATUS_COLORS.invited;

  const handleEventPress = (event) => {
    if (event.host_id === user?.user_id) {
      navigate(`/schedule/event/${event.occurrence_id}`);
    } else {
      navigate(`/schedule/rsvp/${event.occurrence_id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t.common?.back || "Back"}
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
            {t.scheduler?.schedule || "Schedule"}
          </h1>
          <Button
            onClick={() => navigate("/schedule/create")}
            className="bg-primary text-black hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t.scheduler?.createEvent || "Schedule Game"}
          </Button>
        </div>

        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          {t.scheduler?.upcoming || "Upcoming"}
        </h2>

        {loading ? (
          <Card className="bg-card border-border/50">
            <CardContent className="p-6 text-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t.common?.loading || "Loading..."}</p>
            </CardContent>
          </Card>
        ) : events.length === 0 ? (
          <Card className="bg-card border-border/50">
            <CardContent className="p-8 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">
                {t.scheduler?.noEvents || "No upcoming games scheduled"}
              </p>
              <Button
                onClick={() => navigate("/schedule/create")}
                className="bg-primary text-black hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t.scheduler?.createEvent || "Schedule Game"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <Card
                key={event.occurrence_id || event.event_id}
                className="bg-card border-border/50 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => handleEventPress(event)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <p className="font-medium text-sm">{event.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.recurrence && event.recurrence !== "none" && (
                        <Repeat className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </span>
                    )}
                    {event.default_buy_in && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${event.default_buy_in} buy-in
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${getRsvpColor(event.my_rsvp)}`}
                    />
                    <span className="text-xs text-muted-foreground capitalize">
                      {event.my_rsvp || (t.scheduler?.invited || "Invited")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
